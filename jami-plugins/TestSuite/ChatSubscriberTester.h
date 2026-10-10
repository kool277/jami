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

#pragma once

#include "observer.h"

#include "plugin/streamdata.h"
#include "plugin/jamiplugin.h"
#include "plugin/chathandler.h"

#include <map>
#include <set>

namespace jami {

class ChatSubscriberTester : public Observer<pluginMessagePtr>
{
public:
    ChatSubscriberTester() {}
    ~ChatSubscriberTester();
    virtual void update(Observable<pluginMessagePtr>*, pluginMessagePtr const&) override {}
    virtual void attached(Observable<pluginMessagePtr>*) override;
    virtual void detached(Observable<pluginMessagePtr>*) override;

protected:
    // Observer pattern
    std::set<Observable<pluginMessagePtr>*> observables_;
    bool isAttached {false};
};
} // namespace jami
