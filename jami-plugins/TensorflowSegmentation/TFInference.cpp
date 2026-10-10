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

#include "TFInference.h"
// Std libraries
#include <fstream>
#include <iostream>
#include <numeric>
#include <stdlib.h>

#ifdef TFLITE
// Tensorflow headers
#include <tensorflow/lite/builtin_op_data.h>
#include <tensorflow/lite/interpreter.h>
#include <tensorflow/lite/kernels/register.h>
#include <tensorflow/lite/model.h>
#include <tensorflow/lite/optional_debug_tools.h>
#else
#ifdef WIN32
#include <WinBase.h>
#endif
#include <tensorflow/core/graph/graph.h>
//#include <tensorflow/core/graph/default_device.h>
#include <tensorflow/core/platform/env.h>
#endif // TFLITE

#include <pluglog.h>

const char sep = separator();
const std::string TAG = "FORESEG";

namespace jami {
TensorflowInference::TensorflowInference(TFModel tfModel)
    : tfModel(tfModel)
{}

TensorflowInference::~TensorflowInference() {}

bool
TensorflowInference::isAllocated() const
{
    return allocated_;
}

#ifdef TFLITE

void
TensorflowInference::loadModel()
{
    Plog::log(Plog::LogPriority::INFO, TAG, "inside loadModel()");
    flatbufferModel = tflite::FlatBufferModel::BuildFromFile(tfModel.modelPath.c_str());
    if (!flatbufferModel) {
        std::runtime_error("Failed to load the model file");
    }
    Plog::log(Plog::LogPriority::INFO, "TENSOR", "MODEL LOADED");
}
void
TensorflowInference::buildInterpreter()
{
    Plog::log(Plog::LogPriority::INFO, TAG, "inside buildInterpreter()");
    // Build the interpreter
    tflite::ops::builtin::BuiltinOpResolver resolver;
    tflite::InterpreterBuilder builder(*flatbufferModel, resolver);
    builder(&interpreter);
    if (interpreter) {
        setInterpreterSettings();
        Plog::log(Plog::LogPriority::INFO, "TENSOR", "INTERPRETER BUILT");

        if (tfModel.useNNAPI) {
            TfLiteDelegate* optionalNnApiDelegate = tflite::NnApiDelegate();

            if (interpreter->ModifyGraphWithDelegate(optionalNnApiDelegate) != kTfLiteOk) {
                Plog::log(Plog::LogPriority::INFO, "TENSOR", "INTERPRETER ERROR!!!");
            } else {
                Plog::log(Plog::LogPriority::INFO, "TENSOR", "INTERPRETER SET");
                allocateTensors();
            }
        } else {
            allocateTensors();
        }
    }
}

void
TensorflowInference::allocateTensors()
{
    if (interpreter->AllocateTensors() != kTfLiteOk) {
        std::runtime_error("Failed to allocate tensors!");
    } else {
        Plog::log(Plog::LogPriority::INFO, "TENSOR", "TENSORS ALLOCATED");
        allocated_ = true;
    }
}

void
TensorflowInference::describeModelTensors() const
{
    // PrintInterpreterState(interpreter.get());
    std::ostringstream oss;
    oss << "=============== inputs/outputs dimensions ==============="
        << "\n";
    const std::vector<int> inputs = interpreter->inputs();
    const std::vector<int> outputs = interpreter->outputs();
    oss << "number of inputs: " << inputs.size() << std::endl;
    oss << "number of outputs: " << outputs.size() << std::endl;

    Plog::log(Plog::LogPriority::INFO, "TENSOR", oss.str());
    int input = interpreter->inputs()[0];
    int output = interpreter->outputs()[0];
    oss << "input 0 index: " << input << std::endl;
    oss << "output 0 index: " << output << std::endl;
    oss << "=============== input dimensions ===============" << std::endl;
    Plog::log(Plog::LogPriority::INFO, "TENSOR", oss.str());
    // get input dimension from the input tensor metadata
    // assuming one input only

    for (size_t i = 0; i < inputs.size(); i++) {
        std::stringstream ss;
        ss << "Input  " << i << "   ➛ ";
        describeTensor(ss.str(), interpreter->inputs()[i]);
    }
    oss.str("");
    oss << "=============== output dimensions ==============="
        << "\n";
    Plog::log(Plog::LogPriority::INFO, "TENSOR", oss.str());
    // get input dimension from the input tensor metadata
    // assuming one input only
    for (size_t i = 0; i < outputs.size(); i++) {
        std::stringstream ss;
        ss << "Output " << i << "   ➛ ";
        describeTensor(ss.str(), interpreter->outputs()[i]);
    }
}

void
TensorflowInference::setInterpreterSettings()
{
    // interpreter->UseNNAPI(tfModel.useNNAPI);
    interpreter->SetAllowFp16PrecisionForFp32(tfModel.allowFp16PrecisionForFp32);

    interpreter->SetNumThreads(static_cast<int>(tfModel.numberOfThreads));
}

void
TensorflowInference::describeTensor(std::string prefix, int index) const
{
    std::vector<int> dimensions = getTensorDimensions(index);
    size_t nbDimensions = dimensions.size();

    std::ostringstream tensorDescription;
    tensorDescription << prefix;
    for (size_t i = 0; i < nbDimensions; i++) {
        if (i == dimensions.size() - 1) {
            tensorDescription << dimensions[i];
        } else {
            tensorDescription << dimensions[i] << " x ";
        }
    }
    tensorDescription << std::endl;
    Plog::log(Plog::LogPriority::INFO, "TENSOR", tensorDescription.str());
}

std::vector<int>
TensorflowInference::getTensorDimensions(int index) const
{
    TfLiteIntArray* dims = interpreter->tensor(index)->dims;
    size_t size = static_cast<size_t>(interpreter->tensor(index)->dims->size);
    std::vector<int> result;
    result.reserve(size);
    for (size_t i = 0; i != size; i++) {
        result.push_back(dims->data[i]);
    }

    dims = nullptr;

    return result;
}

void
TensorflowInference::runGraph()
{
    for (size_t i = 0; i < tfModel.numberOfRuns; i++) {
        if (interpreter->Invoke() != kTfLiteOk) {
            Plog::log(Plog::LogPriority::INFO,
                      "RUN GRAPH",
                      "A problem occured when running the graph");
        }
    }
}

void
TensorflowInference::init()
{
    /// Loading the model
    loadModel();
    buildInterpreter();
    describeModelTensors();
}

#else
// Reads a model graph definition from disk, and creates a session object you
// can use to run it.
void
TensorflowInference::LoadGraph()
{
    tensorflow::GraphDef graph_def;
    tensorflow::Status load_graph_status = tensorflow::ReadBinaryProto(tensorflow::Env::Default(),
                                                                       tfModel.modelPath,
                                                                       &graph_def);
    if (!load_graph_status.ok()) {
        allocated_ = false;
        Plog::log(Plog::LogPriority::INFO, "LOAD GRAPH", "A problem occured when loading the graph");
        return;
    }
    Plog::log(Plog::LogPriority::INFO, "LOAD GRAPH", "graph loaded");

    // Plog::log(Plog::LogPriority::INFO, "GRAPH SIZE: ",
    // std::to_string(graph_def.node_size())); for (auto& node :
    // *graph_def.mutable_node())
    // {
    //     Plog::log(Plog::LogPriority::INFO, "GRAPH NODE: ",
    //     node.name().c_str());
    //     // Plog::log(Plog::LogPriority::INFO, "\tNODE SIZE: ",
    //     node.().c_str());
    // }

    PluginParameters* parameters = getGlobalPluginParameters();

    tensorflow::SessionOptions options;
    if (parameters->useGPU) {
        options.config.mutable_gpu_options()->set_allow_growth(true);
        options.config.mutable_gpu_options()->set_per_process_gpu_memory_fraction(0.3);
    } else {
#ifdef WIN32
        options.config.mutable_device_count()->insert({"CPU", 1});
        options.config.mutable_device_count()->insert({"GPU", 0});
#else
        setenv("CUDA_VISIBLE_DEVICES", "", 1);
#endif
    }

    (&session)->reset(tensorflow::NewSession(options));
    tensorflow::Status session_create_status = session->Create(graph_def);
    if (!session_create_status.ok()) {
        Plog::log(Plog::LogPriority::INFO,
                  "INIT SESSION",
                  "A problem occured when initializating session");
        allocated_ = true;
        return;
    }
    Plog::log(Plog::LogPriority::INFO, "INIT SESSION", "session initialized");

    allocated_ = true;
}

void
TensorflowInference::runGraph()
{
    for (size_t i = 0; i < tfModel.numberOfRuns; i++) {
        // Actually run the image through the model.
        tensorflow::Status run_status = session->Run({{tfModel.inputLayer, imageTensor}},
                                                     {tfModel.outputLayer},
                                                     {},
                                                     &outputs);
        if (!run_status.ok()) {
            Plog::log(Plog::LogPriority::INFO,
                      "RUN GRAPH",
                      "A problem occured when running the graph");
        }
    }
}

void
TensorflowInference::init()
{
    // Loading the model
    LoadGraph();
}
#endif

} // namespace jami
