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

// Library headers
#include "TFModels.h"

// STL
#include <memory>
#include <string>
#include <vector>

#ifdef TFLITE
#include <tensorflow/lite/interpreter.h>
#include <tensorflow/lite/delegates/nnapi/nnapi_delegate.h>

namespace tflite {
class FlatBufferModel;
class Interpreter;
class StatefulNnApiDelegate;
} // namespace tflite

#else
#ifdef WIN32
#define NOMINMAX
#undef min
#undef max
#endif

#include <tensorflow/core/lib/core/status.h>
#include <tensorflow/core/public/session.h>
#include <tensorflow/core/framework/tensor.h>
#include <tensorflow/core/framework/types.pb.h>
#include <tensorflow/core/platform/init_main.h>
#include <tensorflow/core/protobuf/config.pb.h>

namespace tensorflow {
class Tensor;
class Status;
class GraphDef;
class Session;
struct SessionOptions;
class TensorShape;
class Env;
enum DataType : int;
} // namespace tensorflow

#endif

namespace jami {
class TensorflowInference
{
public:
    /**
     * @brief TensorflowInference
     * Takes a supervised model where the model and labels files are defined
     * @param model
     */
    TensorflowInference(TFModel model);
    ~TensorflowInference();

#ifdef TFLITE
    /**
     * @brief loadModel
     * Load the model from the file described in the Supervised Model
     */
    void loadModel();
    void buildInterpreter();
    void setInterpreterSettings();

    /**
     * @brief allocateTensors
     * Tries to allocate space for the tensors
     * In case of success isAllocated() should return true
     */
    void allocateTensors();

    // Debug methods
    void describeModelTensors() const;
    void describeTensor(std::string prefix, int index) const;

#else
    void LoadGraph();
    tensorflow::Tensor imageTensor;

#endif // TFLITE

    /**
     * @brief runGraph
     * runs the underlaying graph model.numberOfRuns times
     * Where numberOfRuns is defined in the model
     */
    void runGraph();

    /**
     * @brief init
     * Inits the model, interpreter, allocates tensors and load the labels
     */
    void init();
    // Getters
    bool isAllocated() const;

protected:
#ifdef TFLITE
    /**
     * @brief getTensorDimensions
     * Utility method to get Tensorflow Tensor dimensions
     * Given the index of the tensor, the function gives back a vector
     * Where each element is the dimension of the vector-space (finite dimension)
     * Thus, vector.size() is the number of vector-space used by the tensor
     * @param index
     * @return
     */
    std::vector<int> getTensorDimensions(int index) const;

    // Tensorflow model and interpreter
    std::unique_ptr<tflite::FlatBufferModel> flatbufferModel;
    std::unique_ptr<tflite::Interpreter> interpreter;
#else
    std::unique_ptr<tensorflow::Session> session;
    std::vector<tensorflow::Tensor> outputs;
#endif
    TFModel tfModel;
    std::vector<std::string> labels;

    /**
     * @brief nbLabels
     * The real number of labels may not match the labels.size() because of padding
     */
    size_t nbLabels;

    bool allocated_ = false;
};
} // namespace jami
