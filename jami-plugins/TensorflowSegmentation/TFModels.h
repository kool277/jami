/*
 *  Copyright (C) 2004-2021 Savoir-faire Linux Inc.
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

// Std libraries
#include <string>
#include <vector>
#include "pluginParameters.h"

struct TFModelConfiguration
{
    TFModelConfiguration(std::string& model)
        : modelPath {model}
    {}
    std::string modelPath;
    std::vector<unsigned int> normalizationValues;
    std::vector<int> dims = {1, 385, 385, 3}; // model Input dimensions
    unsigned int numberOfRuns = 1;
    // TensorflowLite specific settings

#ifdef TFLITE
#ifdef __ANDROID__
    bool useNNAPI = true;
#else
    bool useNNAPI = false;
#endif //__ANDROID__
    bool allowFp16PrecisionForFp32 = true;
    unsigned int numberOfThreads = 1;

    // User defined details
    bool inputFloating = false;
#else
    std::string inputLayer = "sub_2";
    std::string outputLayer = "float_segments";
#endif // TFLITE
};

struct TFModel : TFModelConfiguration
{
    TFModel(std::string&& model, std::string&& labels)
        : TFModelConfiguration(model)
        , labelsPath {labels}
    {}
    TFModel(std::string& model, std::string& labels)
        : TFModelConfiguration(model)
        , labelsPath {labels}
    {}
    TFModel(std::string&& model)
        : TFModelConfiguration(model)
    {}
    TFModel(std::string& model)
        : TFModelConfiguration(model)
    {}

    std::string labelsPath = " ";
    unsigned int labelsPadding = 16;
};
