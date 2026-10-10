#ifndef STT_WHISPER_H_
#define STT_WHISPER_H_

#include <atomic>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#define WHISPER_SAMPLE_RATE 16000

struct transcribed_msg {
  std::string text;
  bool is_partial;
};

class WavWriter;

class RealtimeSttWhisper
{
 public:
  RealtimeSttWhisper(const std::string& path_model);
  ~RealtimeSttWhisper();
  void AddAudioData(const float* data, size_t n_samples);
  std::vector<transcribed_msg> GetTranscribed();
  void setLanguage(const std::string& lang) {
    std::lock_guard<std::mutex> lock(s_mutex);
    lang_ = lang;
  }

 private:
  struct whisper_context* ctx;
  std::string lang_;
  std::atomic<bool> is_running;
  std::vector<float> s_queued_pcmf32;
  std::vector<transcribed_msg> s_transcribed_msgs;
  std::mutex s_mutex;  // for accessing shared variables from both main thread and worker thread
  std::thread worker;
  void Run();
  std::chrono::time_point<std::chrono::high_resolution_clock> t_last_iter;
};

#endif  // STT_WHISPER_H_
