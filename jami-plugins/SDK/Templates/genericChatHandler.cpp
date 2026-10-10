HEADER

#include "GENERICChatHandler.h"

#include "pluglog.h"

const char sep = separator();
const std::string TAG = "GENERIC";

#define NAME "GENERIC"

namespace jami {

GENERICChatHandler::GENERICChatHandler(const JAMI_PluginAPI* api,
                                       std::map<std::string, std::string>&& preferences,
                                       std::string&& dataPath)
    : api_ {api}
    , datapath_ {dataPath}
{
    preferences_ = preferences;
    setId(datapath_);
    GENERICChatSubscriber_ = std::make_shared<GENERICChatSubscriber>(api_);
};

void
GENERICChatHandler::notifyChatSubject(std::pair<std::string, std::string>& subjectConnection,
                                      chatSubjectPtr subject)
{
    if (subjects.find(subject) == subjects.end()) {
        std::ostringstream oss;
        oss << "NEW SUBJECT: account = " << subjectConnection.first
            << " peer = " << subjectConnection.second << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        subject->attach(GENERICChatSubscriber_.get());
        subjects.insert(subject);
    }
}

std::map<std::string, std::string>
GENERICChatHandler::getChatHandlerDetails()
{
    return { {"name", NAME},
             {"iconPath", datapath_ + sep + "icon.svg"},
             {"pluginId", id()} };
}

void
GENERICChatHandler::setPreferenceAttribute(const std::string& key, const std::string& value)
{
    auto it = preferences_.find(key);
    if (it != preferences_.end() && it->second != value) {
        it->second = value;----------------
        if (key == "PREFERENCE1") {
            // use preference
            return;
        }----------------
    }
}

bool
GENERICChatHandler::preferenceMapHasKey(const std::string& key)
{----------------
    if (key == "PREFERENCE2") { return true; }----------------
    return false;
}

void
GENERICChatHandler::detach(chatSubjectPtr subject)
{
    if (subjects.find(subject) != subjects.end()) {
        subject->detach(GENERICChatSubscriber_.get());
        subjects.erase(subject);
    }
}

GENERICChatHandler::~GENERICChatHandler()
{
    auto& copy(subjects);
    for (const auto& subject : copy) {
        detach(subject);
    }
    copy.clear();
}
} // namespace jami
