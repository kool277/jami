HEADER

#pragma once
// Project
#include "GENERICChatSubscriber.h"
// Jami plugin
#include "plugin/jamiplugin.h"
#include "plugin/chathandler.h"

#include <string>
#include <map>
#include <memory>
#include <set>

using chatSubjectPtr = std::shared_ptr<jami::PublishObservable<jami::pluginMessagePtr>>;

namespace jami {

class GENERICChatHandler : public jami::ChatHandler
{
public:
    GENERICChatHandler(const JAMI_PluginAPI* api,
                   std::map<std::string, std::string>&& preferences,
                   std::string&& dataPath);
    ~GENERICChatHandler();

    virtual void notifyChatSubject(std::pair<std::string, std::string>& subjectConnection,
                                   chatSubjectPtr subject) override;
    virtual std::map<std::string, std::string> getChatHandlerDetails() override;
    virtual void detach(chatSubjectPtr subject) override;
    virtual void setPreferenceAttribute(const std::string& key, const std::string& value) override;
    virtual bool preferenceMapHasKey(const std::string& key) override;

    std::shared_ptr<GENERICChatSubscriber> GENERICChatSubscriber_;

private:
    const JAMI_PluginAPI* api_;
    const std::string datapath_;
    std::map<std::string, std::string> preferences_;
    std::set<chatSubjectPtr> subjects;
};
} // namespace jami
