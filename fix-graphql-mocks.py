#!/usr/bin/env python3

import re

# Lire le fichier
with open('/Users/francoisschuers/Documents/workspace/lagoon-mcp/tests/tools/get-price-history.test.ts', 'r') as f:
    content = f.read()

# Remplacer graphqlClient.request par vi.mocked(graphqlClient).request
content = re.sub(r'\bgraphqlClient\.request\.mock', 'vi.mocked(graphqlClient).request.mock', content)

# Écrire le fichier modifié
with open('/Users/francoisschuers/Documents/workspace/lagoon-mcp/tests/tools/get-price-history.test.ts', 'w') as f:
    f.write(content)

print("Corrections appliquées dans get-price-history.test.ts")