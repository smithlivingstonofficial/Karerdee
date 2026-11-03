using System;
using System.Windows;
using SafeExamClient.Security;

namespace SafeExamClient
{
    public partial class App : Application
    {
        protected override async void OnStartup(StartupEventArgs e)
        {
            // Enforce Single-Instance Architecture:
            // If an instance of SafeExamClient is already running (e.g. at login or waiting screen),
            // forward any kareses:// launch argument to it via Named Pipe and exit quietly.
            if (!SingleInstanceIpc.IsFirstInstance())
            {
                if (e.Args.Length > 0)
                {
                    await SingleInstanceIpc.SendArgsToFirstInstanceAsync(e.Args);
                }

                Environment.Exit(0);
                return;
            }

            base.OnStartup(e);
        }

        protected override void OnExit(ExitEventArgs e)
        {
            SingleInstanceIpc.Cleanup();
            base.OnExit(e);
        }
    }
}
