# Tests d'Intégration Claude Desktop

Ce dossier contient les tests d'intégration qui vérifient la compatibilité du serveur MCP Lagoon avec Claude Desktop.

## 📁 Fichiers

### `claude-desktop-compatibility.test.ts`
Test principal qui vérifie :
- ✅ Démarrage du serveur MCP
- ✅ Communication protocole MCP 2024-11-05
- ✅ Listing des 13 outils disponibles
- ✅ Validation des schémas JSON
- ✅ Exécution de requêtes GraphQL
- ✅ Performance et stabilité

### `TEST_RESULTS.md`
Documentation des résultats des tests et guide de configuration Claude Desktop.

## 🚀 Exécution

```bash
# Tests d'intégration uniquement
npm run test:integration

# Tous les tests (unitaires + intégration)
npm test
```

## 🎯 Objectif

Ces tests simulent l'interaction de Claude Desktop avec le serveur MCP pour s'assurer que :
1. Le serveur respecte le protocole MCP
2. Tous les outils sont correctement exposés
3. Les schémas de données sont valides
4. La connectivité avec l'API Lagoon fonctionne
5. Les performances sont acceptables

## ✅ Résultats Attendus

- **4 tests réussis** sur 4
- **Durée < 2 secondes**
- **13 outils MCP** détectés et validés
- **Communication stable** avec le serveur