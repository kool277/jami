HEADER

#pragma once

extern "C" {
#include <libavutil/frame.h>
}
#include <observer.h>
---DATATYPEINCLUDES
---

namespace jami {

class GENERICDATATYPESubscriber : public Observer<AVFrame*>
{
public:
    GENERICDATATYPESubscriber(const std::string& dataPath);
    ~GENERICDATATYPESubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();

private:
    // Observer pattern
    Observable<AVFrame*>* observable_{};

    // Data
    std::string path_;---
    DATATYPEPRIVATE
---
    // Status variables of the processing
    bool firstRun {true};
};
} // namespace jami
