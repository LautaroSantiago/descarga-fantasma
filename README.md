# 👻 Descarga Fantasma

**Las descargas del navegador nunca tocan el disco. Se van directo a la nube.**

Extensión de Chrome (Manifest V3) que intercepta las descargas y las sube
automáticamente a Google Drive, sin dejar rastro en el almacenamiento
local del equipo.

> Pensada para usar en una PC que **no es tuya** (notebook laboral, equipo
> compartido, etc.) cuando necesitás bajar archivos pero no querés dejar
> nada guardado ahí — por privacidad, por política de la empresa, o para
> evitar el riesgo de que un archivo infectado quede alojado en un disco
> que no administrás vos.

---

## Índice

- [Cómo funciona](#cómo-funciona)
- [Instalación](#instalación)
  - [1. Cargar la extensión](#1-cargar-la-extensión-en-chrome)
  - [2. Credenciales OAuth en Google Cloud](#2-credenciales-oauth-en-google-cloud)
  - [3. Conectar con tu cuenta](#3-conectar-con-tu-cuenta)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Permisos](#permisos)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Roadmap](#roadmap)
- [Autor](#autor)

---

## Cómo funciona

```
click en un link de descarga
        │
        ▼
content.js intercepta el click
   y cancela la navegación
        │
        ▼
background.js hace fetch() del
  archivo (queda solo en RAM)
        │
        ▼
autenticación con Google
    (chrome.identity)
        │
        ▼
se sube a la carpeta
"Descargas Extension" de Drive
        │
        ▼
     notificación ✅
```

Como red de seguridad, si algún archivo dispara igual una descarga nativa
del navegador (por ejemplo uno que el servidor inicia sin pasar por un
`<a>` clickeable), la extensión la cancela apenas se crea, borra cualquier
resto en disco y repite la subida a mano.

## Instalación

### 1. Cargar la extensión en Chrome

1. Clonar/descargar este repo.
2. `chrome://extensions`
3. Activar **Modo de desarrollador**.
4. **Cargar descomprimida** → seleccionar la carpeta del proyecto.
5. Anotar el **ID de la extensión** (lo pide el paso siguiente).

### 2. Credenciales OAuth en Google Cloud

1. [Google Cloud Console](https://console.cloud.google.com/) → crear
   proyecto.
2. **APIs y servicios → Biblioteca** → habilitar **Google Drive API**.
3. **Pantalla de consentimiento OAuth**:
   - Externo → nombre de la app, email de contacto.
   - Scope: `https://www.googleapis.com/auth/drive.file`.
   - Usuarios de prueba: tu cuenta de Google.
4. **Credenciales → Crear credenciales → ID de cliente OAuth**:
   - Tipo: **Extensión de Chrome**.
   - ID del artículo: el ID que anotaste antes.
   - Copiar el **Client ID** generado.
5. Pegarlo en `manifest.json`:

   ```json
   "oauth2": {
     "client_id": "TU_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/drive.file"]
   }
   ```

6. Recargar la extensión desde `chrome://extensions`.

### 3. Conectar con tu cuenta

Ícono de la extensión → **Conectar con Google Drive** → elegir cuenta →
aceptar permisos. Desde ahí, cada descarga se sube sola a la carpeta
`Descargas Extension` de tu Drive.

## Estructura del proyecto

```
descarga-fantasma/
├── manifest.json    # config MV3
├── background.js    # fetch + subida a Drive + OAuth
├── content.js       # intercepta clicks en links de descarga
├── popup.html/.js   # estado de conexión + historial
├── icons/
└── README.md
```

## Permisos

| Permiso | Para qué |
|---|---|
| `downloads` | cancelar descargas nativas que se escapen del content script |
| `storage` | cachear id de carpeta + historial de subidas |
| `identity` | OAuth con Google sin pedir usuario/contraseña |
| `notifications` | feedback de progreso |
| `host_permissions: <all_urls>` | poder hacer fetch() del archivo sea cual sea el sitio |

Scope de Drive usado: `drive.file` — el más restrictivo. Solo puede tocar
los archivos que ella misma crea, no tiene acceso al resto del Drive.

## Limitaciones conocidas

- "Guardar como…" manual desde el navegador no se intercepta.
- El visor de PDF nativo de Chrome abre el archivo sin disparar una
  descarga real (el botón de descargar *dentro* del visor sí queda
  cubierto).
- Archivos bajados por apps fuera del navegador, obviamente, no aplica.

Para el uso normal — clickear un link de descarga en una página — el
archivo nunca queda en el disco.

## Roadmap

- [ ] Elegir carpeta destino desde el popup
- [ ] Soporte para otros proveedores (OneDrive, Dropbox)
- [ ] Progreso real de subida en vez de "subiendo / listo"
- [ ] Excluir dominios específicos de la interceptación

## Autor

**Lautaro Subeldia**
Tecnicatura Universitaria en Programación — UTN FRA

- GitHub: [github.com/LautaroSantiago](https://github.com/LautaroSantiago)
- LinkedIn: [linkedin.com/in/lautaro-subeldia](https://www.linkedin.com/in/lautaro-subeldia/)
