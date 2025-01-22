import bech32

bech32_key = "suiprivkey1qrf4n0jv6e527czfucs5nv93570a8kahekxuzct3c7nztcl83ex7uwjqygj"
hrp, data = bech32.bech32_decode(bech32_key)
if hrp == "suiprivkey":
    converted = bech32.convertbits(data, 5, 8, False)
    hex_key = ''.join('{:02x}'.format(x) for x in converted)
    print(hex_key)