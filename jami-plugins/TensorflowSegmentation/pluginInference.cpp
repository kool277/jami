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

#include "pluginInference.h"
// Std libraries
#include "pluglog.h"
#include <cstring>
#include <numeric>

const char sep = separator();
const std::string TAG = "FORESEG";

namespace jami {

PluginInference::PluginInference(TFModel model)
    : TensorflowInference(model)
{
#ifndef TFLITE
    // Initialize TENSORFLOW_CC lib
    static const char* kFakeName = "fake program name";
    int argc = 1;
    char* fake_name_copy = strdup(kFakeName);
    char** argv = &fake_name_copy;
    tensorflow::port::InitMain(kFakeName, &argc, &argv);
    if (argc > 1) {
        Plog::log(Plog::LogPriority::INFO, "TENSORFLOW INIT", "Unknown argument ");
    }
    free(fake_name_copy);
#endif // TFLITE
}

PluginInference::~PluginInference() {}

#ifdef TFLITE
std::pair<uint8_t*, std::vector<int>>
PluginInference::getInput()
{
    // We assume that we have only one input
    // Get the input index
    int input = interpreter->inputs()[0];

    uint8_t* inputDataPointer = interpreter->typed_tensor<uint8_t>(input);
    // Get the input dimensions vector
    std::vector<int> dims = getTensorDimensions(input);

    return std::make_pair(inputDataPointer, dims);
}

// // Types returned by tensorflow
// int type = interpreter->tensor(outputIndex)->type
// typedef enum {
// kTfLiteNoType = 0,
// kTfLiteFloat32 = 1, float
// kTfLiteInt32 = 2, int // int32_t
// kTfLiteUInt8 = 3, uint8_t
// kTfLiteInt64 = 4, int64_t
// kTfLiteString = 5,
// kTfLiteBool = 6,
// kTfLiteInt16 = 7, int16_t
// kTfLiteComplex64 = 8,
// kTfLiteInt8 = 9, int8_t
// kTfLiteFloat16 = 10, float16_t
// } TfLiteType;

std::vector<float>
PluginInference::masksPredictions() const
{
    int outputIndex = interpreter->outputs()[0];
    std::vector<int> dims = getTensorDimensions(outputIndex);
    int totalDimensions = 1;
    for (size_t i = 0; i < dims.size(); i++) {
        totalDimensions *= dims[i];
    }
    std::vector<float> out;

    int type = interpreter->tensor(outputIndex)->type;
    switch (type) {
    case 1: {
        float* outputDataPointer = interpreter->typed_tensor<float>(outputIndex);
        std::vector<float> output(outputDataPointer, outputDataPointer + totalDimensions);
        out = std::vector<float>(output.begin(), output.end());
        break;
    }
    case 2: {
        int* outputDataPointer = interpreter->typed_tensor<int>(outputIndex);
        std::vector<int> output(outputDataPointer, outputDataPointer + totalDimensions);
        out = std::vector<float>(output.begin(), output.end());
        break;
    }
    case 4: {
        int64_t* outputDataPointer = interpreter->typed_tensor<int64_t>(outputIndex);
        std::vector<int64_t> output(outputDataPointer, outputDataPointer + totalDimensions);
        out = std::vector<float>(output.begin(), output.end());
        break;
    }
    }

    return out;
}

void
PluginInference::setExpectedImageDimensions()
{
    // We assume that we have only one input
    // Get the input index
    int input = interpreter->inputs()[0];
    // Get the input dimensions vector
    std::vector<int> dims = getTensorDimensions(input);

    imageWidth = dims.at(1);
    imageHeight = dims.at(2);
    imageNbChannels = dims.at(3);
}
#else // TFLITE
// Given an image file name, read in the data, try to decode it as an image,
// resize it to the requested size, and then scale the values as desired.
void
PluginInference::ReadTensorFromMat(const cv::Mat& image)
{
    imageTensor = tensorflow::Tensor(tensorflow::DataType::DT_FLOAT,
                                     tensorflow::TensorShape({1, image.cols, image.rows, 3}));
    float* p = imageTensor.flat<float>().data();
    cv::Mat temp(image.rows, image.cols, CV_32FC3, p);
    image.convertTo(temp, CV_32FC3);
}

std::vector<float>
PluginInference::masksPredictions() const
{
    std::vector<int> dims;
    int flatSize = 1;
    int num_dimensions = outputs[0].shape().dims();
    for (int ii_dim = 0; ii_dim < num_dimensions; ii_dim++) {
        dims.push_back(outputs[0].shape().dim_size(ii_dim));
        flatSize *= outputs[0].shape().dim_size(ii_dim);
    }

    std::vector<float> out;
    int type = outputs[0].dtype();

    switch (type) {
    case tensorflow::DataType::DT_FLOAT: {
        for (int offset = 0; offset < flatSize; offset++) {
            out.push_back(outputs[0].flat<float>()(offset));
        }
        break;
    }
    case tensorflow::DataType::DT_INT32: {
        for (int offset = 0; offset < flatSize; offset++) {
            out.push_back(static_cast<float>(outputs[0].flat<tensorflow::int32>()(offset)));
        }
        break;
    }
    case tensorflow::DataType::DT_INT64: {
        for (int offset = 0; offset < flatSize; offset++) {
            out.push_back(static_cast<float>(outputs[0].flat<tensorflow::int64>()(offset)));
        }
        break;
    }
    default: {
        for (int offset = 0; offset < flatSize; offset++) {
            out.push_back(0);
        }
        break;
    }
    }
    return out;
}

void
PluginInference::setExpectedImageDimensions()
{
    if (tfModel.dims[1] != 0)
        imageWidth = tfModel.dims[1];
    if (tfModel.dims[2] != 0)
        imageHeight = tfModel.dims[2];
    if (tfModel.dims[3] != 0)
        imageNbChannels = tfModel.dims[3];
}
#endif

int
PluginInference::getImageWidth() const
{
    return imageWidth;
}

int
PluginInference::getImageHeight() const
{
    return imageHeight;
}

int
PluginInference::getImageNbChannels() const
{
    return imageNbChannels;
}
} // namespace jami
