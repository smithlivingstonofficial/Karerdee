using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace SafeExamClient.Security
{
    /// <summary>
    /// Manages single-instance application lifecycle and inter-process communication (IPC).
    /// When a secondary instance is launched via a browser protocol link (kareses://),
    /// it transmits the URI to the existing primary instance via a Named Pipe and exits cleanly.
    /// </summary>
    public static class SingleInstanceIpc
    {
        private const string MutexName = "Global\\KARE_SafeExamClient_SingleInstance_Mutex";
        private const string PipeName = "KARE_SafeExamClient_Ipc_Pipe";
        private static Mutex? _mutex;
        private static CancellationTokenSource? _pipeCts;

        public static bool IsFirstInstance()
        {
            try
            {
                _mutex = new Mutex(true, MutexName, out bool createdNew);
                return createdNew;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Mutex creation notice: {ex.Message}");
                return true;
            }
        }

        public static async Task SendArgsToFirstInstanceAsync(string[] args)
        {
            try
            {
                using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.Out);
                await client.ConnectAsync(1000);
                string message = string.Join("\n", args);
                byte[] data = Encoding.UTF8.GetBytes(message);
                await client.WriteAsync(data, 0, data.Length);
                await client.FlushAsync();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to send args to primary instance: {ex.Message}");
            }
        }

        public static void StartIpcServer(Action<string> onUriReceived)
        {
            _pipeCts = new CancellationTokenSource();
            Task.Run(async () =>
            {
                while (!_pipeCts.Token.IsCancellationRequested)
                {
                    try
                    {
                        using var server = new NamedPipeServerStream(
                            PipeName,
                            PipeDirection.In,
                            NamedPipeServerStream.MaxAllowedServerInstances,
                            PipeTransmissionMode.Byte,
                            PipeOptions.Asynchronous);

                        await server.WaitForConnectionAsync(_pipeCts.Token);

                        using var reader = new StreamReader(server, Encoding.UTF8);
                        string message = await reader.ReadToEndAsync();

                        if (!string.IsNullOrWhiteSpace(message))
                        {
                            var lines = message.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                            foreach (var line in lines)
                            {
                                if (line.Trim().StartsWith("kareses://", StringComparison.OrdinalIgnoreCase))
                                {
                                    onUriReceived(line.Trim());
                                    break;
                                }
                            }
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"IPC Pipe Server notice: {ex.Message}");
                        await Task.Delay(500);
                    }
                }
            });
        }

        public static void Cleanup()
        {
            try
            {
                _pipeCts?.Cancel();
                _pipeCts?.Dispose();
                _mutex?.Dispose();
            }
            catch {}
        }
    }
}

