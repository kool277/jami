/**
 *  Copyright (C) 2020-2021 Savoir-faire Linux Inc.
 *
 *  Author: Aline Gondim Santos <aline.gondimsantos@savoirfairelinux.com>
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.
 */

#include "AudioSubscriberTester.h"

#include <pluglog.h>

const std::string TAG = "AudioHandlerTester";
const char sep = separator();

namespace jami {

AudioSubscriberTester::~AudioSubscriberTester()
{
    std::ostringstream oss;
    oss << "~AudioSubscriberTester" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
AudioSubscriberTester::attached(Observable<AVFrame*>* observable)
{
    std::ostringstream oss;
    oss << "::Attached ! " << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    observable_ = observable;
}

void
AudioSubscriberTester::detached(Observable<AVFrame*>*)
{
    observable_ = nullptr;
    std::ostringstream oss;
    oss << "::Detached()" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
AudioSubscriberTester::detach()
{
    if (observable_) {
        std::ostringstream oss;
        oss << "::Calling detach()" << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        observable_->detach(this);
    }
}
} // namespace jami
