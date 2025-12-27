import sys
with open('backend_verify.log', 'r') as f:
    for line in f:
        if '[XLSM]' in line:
            print(line.strip())
