HEADER

#include "GENERICMediaHandler.h"

#include "pluglog.h"
#include <string_view>

const char sep = separator();
const std::string TAG = "GENERIC";

#define NAME "GENERIC"

namespace jami {

GENERICMediaHandler::GENERICMediaHandler(std::map<std::string, std::string>&& preferences,
                                         std::string&& datapath)
    : datapath_ {datapath}
    , preferences_ {preferences}
{
    setId(datapath_);
    mediaSubscriber_ = std::make_shared<GENERICDATATYPESubscriber>(datapath_);
}

void
GENERICMediaHandler::notifyAVFrameSubject(const StreamData& data, jami::avSubjectPtr subject)
{
    std::ostringstream oss;
    std::string_view direction = data.direction ? "Receive" : "Preview";
    oss << "NEW SUBJECT: [" << data.id << "," << direction << "]" << std::endl;

    bool preferredStreamDirection = false; // false for output; true for input
    oss << "preferredStreamDirection " << preferredStreamDirection << std::endl;
    if (data.type == StreamType::DataType && !data.direction
        && data.direction == preferredStreamDirection) {
        subject->attach(mediaSubscriber_.get()); // your media
        oss << "got my sent image attached" << std::endl;
        attached_ = "1";
    } else if (data.type == StreamType::DataType && data.direction
               && data.direction == preferredStreamDirection) {
        subject->attach(mediaSubscriber_.get()); // the media you receive from others on the call
        oss << "got received image attached" << std::endl;
        attached_ = "1";
    }

    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

std::map<std::string, std::string>
GENERICMediaHandler::getCallMediaHandlerDetails()
{
    return {{"name", NAME},
            {"iconPath", datapath_ + sep + "icon.svg"},
            {"pluginId", id()},
            {"attached", attached_},
            {"dataType", "1"}};
}

void
GENERICMediaHandler::setPreferenceAttribute(const std::string& key, const std::string& value)
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
GENERICMediaHandler::preferenceMapHasKey(const std::string& key)
{----------------
    if (key == "PREFERENCE2") { return true; }----------------
    return false;
}

void
GENERICMediaHandler::detach()
{
    attached_ = "0";
    mediaSubscriber_->detach();
}

GENERICMediaHandler::~GENERICMediaHandler()
{
    std::ostringstream oss;
    oss << " ~GENERICMediaHandler from PLUGINID Plugin" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    detach();
}
} // namespace jami
