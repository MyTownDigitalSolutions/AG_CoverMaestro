try:
    with open('backend_verify.log', 'rb') as f:
        # Try detecting encoding or just try common ones
        raw = f.read()
        
    try:
        text = raw.decode('utf-16')
    except:
        text = raw.decode('utf-8', errors='ignore')

    for line in text.splitlines():
        if '[XLSM]' in line and 'HIT' in line:
            print(line)
            
except Exception as e:
    print(e)
