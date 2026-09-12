using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace GeminiPetWatcher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "GeminiPetWatcherSingleInstanceMutex", out createdNew))
            {
                if (!createdNew) return;

                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string petDataDir = Path.Combine(appData, "GeminiPet");
                string configFile = Path.Combine(petDataDir, "config.json");
                string sessionFile = Path.Combine(petDataDir, "session_state.json");

                int lastSeenAntigravityPid = 0;
                int suppressedPid = 0;

                while (true)
                {
                    try
                    {
                        string syncMode = "manual";
                        string petExePath = null;
                        if (File.Exists(configFile))
                        {
                            string json = File.ReadAllText(configFile);
                            syncMode = ExtractJsonValue(json, "antigravitySyncMode") ?? "manual";
                            petExePath = ExtractJsonValue(json, "petExePath");
                        }

                        // If user set mode back to manual, watcher gracefully exits
                        if (syncMode == "manual")
                        {
                            break;
                        }

                        // Check if Antigravity.exe is running
                        Process[] agProcesses = Process.GetProcessesByName("Antigravity");
                        bool agRunning = agProcesses.Length > 0;
                        int currentAgPid = agRunning ? agProcesses[0].Id : 0;

                        // Check session suppression (if user manually closed pet in this Antigravity session)
                        if (File.Exists(sessionFile))
                        {
                            try
                            {
                                string sessJson = File.ReadAllText(sessionFile);
                                string suppStr = ExtractJsonValue(sessJson, "suppressedPid");
                                int.TryParse(suppStr, out suppressedPid);
                            }
                            catch { }
                        }

                        if (!agRunning)
                        {
                            lastSeenAntigravityPid = 0;
                            suppressedPid = 0;
                            try { if (File.Exists(sessionFile)) File.Delete(sessionFile); } catch { }
                        }
                        else
                        {
                            lastSeenAntigravityPid = currentAgPid;
                        }

                        // If Antigravity is running and not suppressed, ensure GeminiPet is running
                        if (agRunning && (currentAgPid != suppressedPid))
                        {
                            Process[] petProcesses = Process.GetProcessesByName("GeminiPet");
                            if (petProcesses.Length == 0)
                            {
                                if (!string.IsNullOrEmpty(petExePath) && File.Exists(petExePath))
                                {
                                    ProcessStartInfo psi = new ProcessStartInfo();
                                    psi.FileName = petExePath;
                                    psi.WorkingDirectory = Path.GetDirectoryName(petExePath);
                                    psi.UseShellExecute = true;
                                    Process.Start(psi);
                                    Thread.Sleep(3000);
                                }
                            }
                        }
                    }
                    catch
                    {
                        // Ignore intermittent read errors and keep alive
                    }

                    Thread.Sleep(2500);
                }
            }
        }

        static string ExtractJsonValue(string json, string key)
        {
            if (string.IsNullOrEmpty(json) || string.IsNullOrEmpty(key)) return null;
            string pattern = "\"" + key + "\"";
            int idx = json.IndexOf(pattern, StringComparison.OrdinalIgnoreCase);
            if (idx < 0) return null;
            int colonIdx = json.IndexOf(':', idx + pattern.Length);
            if (colonIdx < 0) return null;
            int start = colonIdx + 1;
            while (start < json.Length && (json[start] == ' ' || json[start] == '\t' || json[start] == '\r' || json[start] == '\n')) start++;
            if (start >= json.Length) return null;
            if (json[start] == '\"')
            {
                int end = json.IndexOf('\"', start + 1);
                if (end < 0) return null;
                return json.Substring(start + 1, end - start - 1).Replace("\\\\", "\\");
            }
            else
            {
                int end = start;
                while (end < json.Length && json[end] != ',' && json[end] != '}' && json[end] != '\r' && json[end] != '\n') end++;
                return json.Substring(start, end - start).Trim();
            }
        }
    }
}
