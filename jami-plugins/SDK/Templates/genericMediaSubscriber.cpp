HEADER

#include "GENERICDATATYPESubscriber.h"

---
extern "C" {
FFMPEGDATATYPEINCLUDES
}---
---DATATYPEINCLUDES
---
#include <pluglog.h>
#include <frameUtils.h>

const std::string TAG = "GENERIC";
const char sep = separator();

namespace jami {

GENERICDATATYPESubscriber::GENERICDATATYPESubscriber(const std::string& dataPath)
    : path_ {dataPath}
{}

GENERICDATATYPESubscriber::~GENERICDATATYPESubscriber()
{
    std::ostringstream oss;
    oss << "~GENERICMediaProcessor" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
GENERICDATATYPESubscriber::update(jami::Observable<AVFrame*>*, AVFrame* const& pluginFrame)
{
---DATATYPEUPDATE---
}

void
GENERICDATATYPESubscriber::attached(jami::Observable<AVFrame*>* observable)
{
    std::ostringstream oss;
    oss << "::Attached ! " << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    observable_ = observable;
}

void
GENERICDATATYPESubscriber::detached(jami::Observable<AVFrame*>*)
{
    firstRun = true;
    observable_ = nullptr;
    std::ostringstream oss;
    oss << "::Detached()" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
GENERICDATATYPESubscriber::detach()
{
    if (observable_) {
        firstRun = true;
        std::ostringstream oss;
        oss << "::Calling detach()" << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        observable_->detach(this);
    }
}
} // namespace jami
