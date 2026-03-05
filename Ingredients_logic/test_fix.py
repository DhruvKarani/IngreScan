from ingredient_parser import process_ingredient

print("Testing INS412 processing:")
result = process_ingredient('INS412')

print(f"Common Name: {result['common_name']}")
print(f"Description: {result['description']}")
print(f"Risk Level: {result['risk_level']}")

if result.get('additive_info'):
    add_info = result['additive_info']
    print(f"Additive Category: {add_info['category']}")
    print(f"Purpose: {add_info['purpose']}")
    print(f"Status: {add_info['regulatory_status']}")
else:
    print("No additive info found")

print(f"Found in: {result['found_in']}")
