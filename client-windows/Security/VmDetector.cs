using System;
using System.Management;
using System.Net.NetworkInformation;

namespace SafeExamClient.Security
{
    public static class VmDetector
    {
        public static bool IsVirtualMachine(out string reason)
        {
            reason = string.Empty;

            try
            {
                // 1. WMI System Model & Manufacturer Check
                using var searcher = new ManagementObjectSearcher("SELECT Manufacturer, Model FROM Win32_ComputerSystem");
                foreach (var item in searcher.Get())
                {
                    string manufacturer = item["Manufacturer"]?.ToString()?.ToLowerInvariant() ?? "";
                    string model = item["Model"]?.ToString()?.ToLowerInvariant() ?? "";

                    if (manufacturer.Contains("vmware") || model.Contains("vmware"))
                    {
                        reason = "VMware Virtual Machine Environment Detected";
                        return true;
                    }

                    if (manufacturer.Contains("innotek") || model.Contains("virtualbox"))
                    {
                        reason = "Oracle VirtualBox Environment Detected";
                        return true;
                    }

                    if (model.Contains("qemu") || model.Contains("kvm"))
                    {
                        reason = "QEMU/KVM Hypervisor Detected";
                        return true;
                    }

                    if (manufacturer.Contains("microsoft corporation") && model.Contains("virtual"))
                    {
                        reason = "Microsoft Hyper-V Virtual Machine Detected";
                        return true;
                    }
                }

                // 2. Network Adapter MAC Vendor Check
                foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    string mac = nic.GetPhysicalAddress().ToString();
                    if (string.IsNullOrEmpty(mac)) continue;

                    if (mac.StartsWith("000569") || mac.StartsWith("000C29") || mac.StartsWith("005056"))
                    {
                        reason = "VMware Virtual Network Adapter Detected";
                        return true;
                    }

                    if (mac.StartsWith("080027"))
                    {
                        reason = "VirtualBox Virtual Network Adapter Detected";
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                // In strict mode, failure to query WMI can be logged
                System.Diagnostics.Debug.WriteLine($"VM Check error: {ex.Message}");
            }

            return false;
        }
    }
}

