HEADER

#pragma once

#include "observer.h"

#include "plugin/streamdata.h"
#include "plugin/jamiplugin.h"
#include "plugin/chathandler.h"

#include <map>
#include <set>

namespace jami {

class GENERICChatSubscriber : public Observer<pluginMessagePtr>
{
public:
    GENERICChatSubscriber(const JAMI_PluginAPI* api);
    ~GENERICChatSubscriber();
    virtual void update(Observable<pluginMessagePtr>*, pluginMessagePtr const&) override;
    virtual void attached(Observable<pluginMessagePtr>*) override;
    virtual void detached(Observable<pluginMessagePtr>*) override;

    void sendText(std::string& accountId,
                  std::string& peerId,
                  std::map<std::string, std::string>& sendMsg);

protected:
    // Observer pattern
    std::set<Observable<pluginMessagePtr>*> observables_;
    bool isAttached {false};
    const JAMI_PluginAPI* api_;
    std::string textAnswer_{};
};
} // namespace jami
