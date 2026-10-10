import onnx

model = onnx.load('modelSRC/mModelEncoder.onnx')
output =[node.name for node in model.graph.output]

input_all = [node.name for node in model.graph.input]
input_initializer =  [node.name for node in model.graph.initializer]
net_feed_input = list(set(input_all)  - set(input_initializer))

print('Encoder Inputs: ', net_feed_input)
print('Encoder Outputs: ', output)
print("")

onnx.checker.check_model(model)
graph_def = model.graph

inputs = graph_def.input
for graph_input in inputs:
    input_shape = []
    for d in graph_input.type.tensor_type.shape.dim:
        if d.dim_value == 0:
            input_shape.append(None)
        else:
            input_shape.append(d.dim_value)
    print(
        f"Input Name: {graph_input.name}, Input Data Type: {graph_input.type.tensor_type.elem_type}, Input Shape: {input_shape}"
    )


print("")
outputs = graph_def.output
for graph_output in outputs:
    output_shape = []
    for d in graph_output.type.tensor_type.shape.dim:
        if d.dim_value == 0:
            output_shape.append(None)
        else:
            output_shape.append(d.dim_value)
    print(
        f"Output Name: {graph_output.name}, Output Data Type: {graph_output.type.tensor_type.elem_type}, Output Shape: {output_shape}"
    )


model = onnx.load('modelSRC/mModelDecoder.onnx')
output =[node.name for node in model.graph.output]

input_all = [node.name for node in model.graph.input]
input_initializer =  [node.name for node in model.graph.initializer]
net_feed_input = list(set(input_all)  - set(input_initializer))

print("\n")

print('Decoder Inputs: ', net_feed_input)
print('Decoder Outputs: ', output)
print("")

onnx.checker.check_model(model)
graph_def = model.graph

inputs = graph_def.input
for graph_input in inputs:
    input_shape = []
    for d in graph_input.type.tensor_type.shape.dim:
        if d.dim_value == 0:
            input_shape.append(None)
        else:
            input_shape.append(d.dim_value)
    print(
        f"Input Name: {graph_input.name}, Input Data Type: {graph_input.type.tensor_type.elem_type}, Input Shape: {input_shape}"
    )

print("")
outputs = graph_def.output
for graph_output in outputs:
    output_shape = []
    for d in graph_output.type.tensor_type.shape.dim:
        if d.dim_value == 0:
            output_shape.append(None)
        else:
            output_shape.append(d.dim_value)
    print(
        f"Output Name: {graph_output.name}, Output Data Type: {graph_output.type.tensor_type.elem_type}, Output Shape: {output_shape}"
    )
