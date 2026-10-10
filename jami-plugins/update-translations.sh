#!/bin/bash

# Update Transifex source files
tx push -s -f

# Update translations
tx pull -a