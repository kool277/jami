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
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301
 * USA.
 */

#pragma once

#include "TFInference.h"

// OpenCV headers
#include <opencv2/core.hpp>
// STL
#include <array>
#include <iostream>
#include <tuple>
#include <vector>

namespace jami {

class PluginInference : public TensorflowInference
{
public:
    /**
     * @brief PluginInference
     * Is a type of supervised learning where we detect objects in images
     * Draw a bounding boxes around them
     * @param model
     */
    PluginInference(TFModel model);
    ~PluginInference();

#ifdef TFLITE
    /**
     * @brief getInput
     * Returns the input where to fill the data
     * Use this method if you know what you are doing, all the necessary checks
     * on dimensions must be done on your part
     * @return std::tuple<uint8_t *, std::vector<int>>
     * The first element in the tuple is the pointer to the storage location
     * The second element is a dimensions vector that will helps you make
     * The necessary checks to make your data size match the input one
     */
    std::pair<uint8_t*, std::vector<int>> getInput();

#else
    void ReadTensorFromMat(const cv::Mat& image);

#endif // TFLITE

    std::vector<float> masksPredictions() const;

    /**
     * @brief setExpectedImageDimensions
     * Sets imageWidth and imageHeight from the sources
     */
    void setExpectedImageDimensions();

    // Getters
    int getImageWidth() const;
    int getImageHeight() const;
    int getImageNbChannels() const;

private:
    int imageWidth = 0;
    int imageHeight = 0;
    int imageNbChannels = 0;
};
} // namespace jami
