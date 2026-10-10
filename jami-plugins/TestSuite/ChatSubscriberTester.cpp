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

#include "ChatSubscriberTester.h"
#include "pluglog.h"

const std::string TAG = "ChatHandlerTester";

namespace jami {

ChatSubscriberTester::~ChatSubscriberTester()
{
    std::ostringstream oss;
    oss << "~ChatSubscriberTester" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
ChatSubscriberTester::attached(Observable<pluginMessagePtr>* observable)
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
ChatSubscriberTester::detached(Observable<pluginMessagePtr>* observable)
{
    auto it = observables_.find(observable);
    if (it != observables_.end()) {
        observables_.erase(it);
        std::ostringstream oss;
        oss << "::Detached()" << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        if (observables_.empty())
            isAttached = false;
    }
}
} // namespace jami
