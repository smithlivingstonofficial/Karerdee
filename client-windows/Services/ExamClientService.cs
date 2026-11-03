using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using SafeExamClient.Models;

namespace SafeExamClient.Services
{
    public sealed class ExamClientService
    {
        private readonly HttpClient _httpClient;

        public ExamClientService()
        {
            _httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(15)
            };
        }

        public async Task<AuthResponseModel> AuthenticateAsync(
            string serverUrl,
            string email,
            string password,
            string examPasscode,
            string hardwareFingerprint)
        {
            string url = $"{serverUrl.TrimEnd('/')}/api/exam/auth";

            var payload = new
            {
                email = email.Trim(),
                password = password.Trim(),
                applicationNumber = password.Trim(),
                examPasscode = examPasscode.Trim(),
                hardwareFingerprint = hardwareFingerprint.Trim(),
                clientVersion = "1.0.0-standalone"
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);
            string json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                try
                {
                    var errorResult = JsonSerializer.Deserialize<AuthResponseModel>(json);
                    if (errorResult != null)
                    {
                        errorResult.Success = false;
                        return errorResult;
                    }
                }
                catch {}
                return new AuthResponseModel { Success = false, Error = "Authentication failed." };
            }

            var result = JsonSerializer.Deserialize<AuthResponseModel>(json);
            return result ?? new AuthResponseModel { Success = false, Error = "Invalid server response structure." };
        }

        public async Task<AuthResponseModel> AuthenticateWithTicketAsync(
            string serverUrl,
            string ticket,
            string hardwareFingerprint)
        {
            string url = $"{serverUrl.TrimEnd('/')}/api/exam/launch-ticket/verify";

            var payload = new
            {
                ticket = ticket.Trim(),
                hardwareFingerprint = hardwareFingerprint.Trim(),
                clientVersion = "1.0.0-standalone"
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);
            string json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                try
                {
                    var errorResult = JsonSerializer.Deserialize<AuthResponseModel>(json);
                    if (errorResult != null)
                    {
                        errorResult.Success = false;
                        return errorResult;
                    }
                }
                catch {}
                return new AuthResponseModel { Success = false, Error = "Direct ticket authentication failed." };
            }

            var result = JsonSerializer.Deserialize<AuthResponseModel>(json);
            return result ?? new AuthResponseModel { Success = false, Error = "Invalid server response structure." };
        }

        public async Task<bool> SyncAnswersAsync(
            string serverUrl,
            string token,
            string sessionId,
            Dictionary<string, List<string>> answers)
        {
            try
            {
                string url = $"{serverUrl.TrimEnd('/')}/api/exam/sync";

                var answerItems = new List<object>();
                foreach (var kvp in answers)
                {
                    answerItems.Add(new
                    {
                        questionId = kvp.Key,
                        selectedOptionIds = kvp.Value,
                        clientTimestamp = DateTime.UtcNow.ToString("o")
                    });
                }

                var payload = new
                {
                    sessionId,
                    answers = answerItems
                };

                using var req = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.SendAsync(req);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public async Task<HeartbeatResponseModel?> SendHeartbeatAsync(
            string serverUrl,
            string token,
            string sessionId,
            string hardwareFingerprint,
            int questionsAnsweredCount)
        {
            try
            {
                string url = $"{serverUrl.TrimEnd('/')}/api/telemetry/heartbeat";

                var payload = new
                {
                    sessionId,
                    hardwareFingerprint,
                    clientTimestamp = DateTime.UtcNow.ToString("o"),
                    questionsAnsweredCount
                };

                using var req = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.SendAsync(req);
                if (!response.IsSuccessStatusCode) return null;

                string json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<HeartbeatResponseModel>(json);
            }
            catch
            {
                return null;
            }
        }

        public async Task ReportViolationAsync(
            string serverUrl,
            string token,
            string sessionId,
            string violationType)
        {
            try
            {
                string url = $"{serverUrl.TrimEnd('/')}/api/telemetry/violation";

                var payload = new
                {
                    sessionId,
                    violationType,
                    metadata = new { clientTime = DateTime.UtcNow.ToString("o") }
                };

                using var req = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                _ = await _httpClient.SendAsync(req);
            }
            catch
            {
                // Watchdog background tolerance
            }
        }

        public async Task<(bool Success, string? ReceiptCode, string? Error)> SubmitExamAsync(
            string serverUrl,
            string token,
            string sessionId,
            Dictionary<string, List<string>> answers)
        {
            try
            {
                string url = $"{serverUrl.TrimEnd('/')}/api/exam/submit";

                var answerItems = new List<object>();
                foreach (var kvp in answers)
                {
                    answerItems.Add(new
                    {
                        questionId = kvp.Key,
                        selectedOptionIds = kvp.Value
                    });
                }

                var payload = new
                {
                    sessionId,
                    answers = answerItems
                };

                using var req = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.SendAsync(req);
                string json = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    string errorMsg = "Exam submission failed.";
                    try
                    {
                        using var doc = JsonDocument.Parse(json);
                        if (doc.RootElement.TryGetProperty("error", out var errProp))
                        {
                            errorMsg = errProp.GetString() ?? errorMsg;
                        }
                    }
                    catch {}
                    return (false, null, errorMsg);
                }

                string receiptCode = $"KARE-SUB-{sessionId.Substring(0, Math.Min(8, sessionId.Length)).ToUpperInvariant()}";
                try
                {
                    using var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("referenceCode", out var refProp))
                    {
                        receiptCode = refProp.GetString() ?? receiptCode;
                    }
                }
                catch {}

                return (true, receiptCode, null);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }
    }
}

