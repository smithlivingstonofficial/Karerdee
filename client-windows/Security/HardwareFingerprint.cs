using System;
using System.Management;
using System.Security.Cryptography;
using System.Text;

namespace SafeExamClient.Security
{
    public static class HardwareFingerprint
    {
        public static string Generate()
        {
            var rawBuilder = new StringBuilder();

            try
            {
                // 1. Processor ID
                using var cpuSearcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor");
                foreach (var obj in cpuSearcher.Get())
                {
                    rawBuilder.Append(obj["ProcessorId"]?.ToString() ?? "");
                    break;
                }

                // 2. Motherboard Serial
                using var boardSearcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BaseBoard");
                foreach (var obj in boardSearcher.Get())
                {
                    rawBuilder.Append(obj["SerialNumber"]?.ToString() ?? "");
                    break;
                }

                // 3. BIOS Serial
                using var biosSearcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
                foreach (var obj in biosSearcher.Get())
                {
                    rawBuilder.Append(obj["SerialNumber"]?.ToString() ?? "");
                    break;
                }
            }
            catch
            {
                // Fallback for sandboxed or restricted user environments
                rawBuilder.Append(Environment.MachineName);
                rawBuilder.Append(Environment.UserName);
            }

            // Produce SHA-256 hash
            byte[] bytes = Encoding.UTF8.GetBytes(rawBuilder.ToString());
            byte[] hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }
    }
}

