# Quelque Chose en Plus

Application de communication Oui / Non par le regard pour les jeunes accompagnés.

- `index.html`, `app.js`, `app.css`, `images/`… : l'application
- `android/` : le projet Android qui fabrique l'APK (les fichiers de l'application sont copiés dans `android/app/src/main/assets/www` avant la compilation)
- `.github/workflows/apk.yml` : fabrication automatique de l'APK sur GitHub

## Fabriquer l'APK à la main
```
mkdir -p android/app/src/main/assets/www
cp -r index.html app.css core.js comm.js games.js learn.js main.js manifest.webmanifest images icons fonts mediapipe android/app/src/main/assets/www/
gradle -p android assembleDebug
```
L'APK se trouve ensuite dans `android/app/build/outputs/apk/debug/app-debug.apk`.
