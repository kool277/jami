HEADER

#include "GENERICChatSubscriber.h"
#include "../lib/pluglog.h"

const std::string TAG = "GENERIC";

namespace jami {

GENERICChatSubscriber::GENERICChatSubscriber(const JAMI_PluginAPI* api)
    : api_ {api}
{}

GENERICChatSubscriber::~GENERICChatSubscriber()
{
    std::ostringstream oss;
    oss << "~GENERICChatProcessor" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
GENERICChatSubscriber::update(Observable<pluginMessagePtr>*, const pluginMessagePtr& message)
{
    if (isAttached) {
        if (message->direction == 0) { // 0 for input message; 1 for output message
            for (auto& pair : message->data) {
                // READ THE MESSAGE
            }
            // DO SOMETHING WITH YOUR TEXT
        }
    }
}

void
GENERICChatSubscriber::attached(Observable<pluginMessagePtr>* observable)
{
    if (observables_.find(observable) == observables_.end()) {
        std::ostringstream oss;
        oss << "::Attached ! " << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        observables_.insert(observable);
        isAttached = true;
    }
}

void
GENERICChatSubscriber::detached(Observable<pluginMessagePtr>* observable)
{
    if (observables_.find(observable) != observables_.end()) {
        observables_.erase(observable);
        std::ostringstream oss;
        oss << "::Detached()" << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        if (observables_.empty())
            isAttached = false;
    }
}

void
GENERICChatSubscriber::sendText(std::string& accountId,
                                std::string& peerId,
                                std::map<std::string, std::string>& sendMsg)
{
    pluginMessagePtr GENERICAnswer = std::make_shared<JamiMessage>(accountId, peerId, "0", sendMsg, true);
    api_->invokeService(api_, "sendTextMessage", GENERICAnswer.get());
}
} // namespace jami
