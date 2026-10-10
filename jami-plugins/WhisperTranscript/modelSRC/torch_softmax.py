from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Iterable, Optional, Sequence, Union, TYPE_CHECKING

import numpy as np
import torch
import torch.onnx
import torch.nn as nn
import torch.nn.functional as F
from torch import Tensor
from torch.distributions import Categorical

class LogSoftMaxDecoder(nn.Module):
    def __init__(self, temperature):
        super(LogSoftMaxDecoder, self).__init__()
        self.logSoftMax = nn.LogSoftmax(dim=-1)
        self.temperature = temperature


    def forward(self, logits: Tensor):
        if (self.temperature == 0):
            next_tokens = logits.argmax(dim=-1)
        else:
            next_tokens = Categorical(logits=logits / self.temperature).sample()
        logprobs = self.logSoftMax(logits)

        return next_tokens, logprobs


# get input output names before exporting
# tokens = torch.randn(1, 51864)
logits = torch.randn(1, 1, 51865)

input_names = [ "logits" ]
output_names = [ "token_ids" ] + [ "probs" ]
model = LogSoftMaxDecoder(0.2)
model.eval()
print(model)
torch.onnx.export(
    model,
    (logits),
    "logSoftMaxdecoder.onnx",
    verbose=False,
    input_names=["logits"],
    output_names=["token_ids", "probs"],
    dynamic_axes={
        "logits": [2]
    }
)
