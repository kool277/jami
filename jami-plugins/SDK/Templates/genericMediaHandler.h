HEADER

#pragma once

#include "GENERICDATATYPESubscriber.h"

#include "plugin/jamiplugin.h"
#include "plugin/mediahandler.h"

namespace jami {

class GENERICMediaHandler : public CallMediaHandler
{
public:
    GENERICMediaHandler(std::map<std::string, std::string>&& preferences, std::string&& dataPath);
    ~GENERICMediaHandler();

    virtual void notifyAVFrameSubject(const StreamData& data, avSubjectPtr subject) override;
    virtual std::map<std::string, std::string> getCallMediaHandlerDetails() override;

    virtual void detach() override;
    virtual void setPreferenceAttribute(const std::string& key, const std::string& value) override;
    virtual bool preferenceMapHasKey(const std::string& key) override;

    std::shared_ptr<GENERICDATATYPESubscriber> mediaSubscriber_;

private:
    const std::string datapath_;
    std::map<std::string, std::string> preferences_;
    std::string attached_ {'0'};
};
} // namespace jami
