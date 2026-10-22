# Entrenar Micelio en el PC de sobremesa (Windows + RTX 3060 12 GB)

TensorFlow ya no usa la GPU en Windows "nativo": se usa **WSL2** (Ubuntu dentro de Windows), donde la tarjeta NVIDIA funciona sin instalar CUDA a mano. Una vez montado, cada entrenamiento tarda 15-30 minutos.

## 1. Preparar Windows (una vez)

1. Actualiza el driver NVIDIA desde GeForce Experience o nvidia.com (cualquier versión de 2025 en adelante vale).
2. Abre PowerShell **como administrador** y ejecuta:
   ```powershell
   wsl --install -d Ubuntu-24.04
   ```
   Reinicia si lo pide. Al abrir "Ubuntu" por primera vez te pedirá un usuario y contraseña (los que quieras).
3. Dentro de Ubuntu comprueba que ve la gráfica:
   ```bash
   nvidia-smi
   ```
   Debe listar la RTX 3060. Si no, actualiza el driver de Windows y reinicia.

## 2. Preparar el entorno de Python (una vez, dentro de Ubuntu)

```bash
sudo apt update && sudo apt install -y python3-venv python3-pip git nodejs npm
mkdir -p ~/proyectos && cd ~/proyectos
git clone https://github.com/gsdgjconde-code/micelio.git
cd micelio
python3 -m venv ~/.micelio/venv
source ~/.micelio/venv/bin/activate
pip install --upgrade pip
pip install "tensorflow[and-cuda]==2.16.2" tf-keras==2.16.0 tensorflowjs==4.20.0 pillow
python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
```
La última línea debe mostrar `[PhysicalDevice(name='/physical_device:GPU:0' ...)]`.

## 3. Las fotos

Las 50.677 fotos están en el disco externo, en `app setas/micelio/entrenar/imagenes` (unos 3 GB). Conecta el disco al PC y copia esa carpeta **dentro de Ubuntu** (leerla a través de la unidad de Windows es lento):

```bash
cp -r "/mnt/d/app setas/micelio/entrenar/imagenes" ~/proyectos/micelio/entrenar/   # cambia D: por la letra del disco
```
Si prefieres no copiar, puedes volver a descargarlas: `python entrenar/descargar_imagenes.py --por-especie 600 --hilos 16` (1-2 horas).

## 4. Entrenar y publicar

```bash
cd ~/proyectos/micelio && source ~/.micelio/venv/bin/activate
python entrenar/entrenar.py --epocas 40 --arquitectura mobilenetv3 --val-lotes 0 --pesos-clase
python entrenar/evaluar.py --division entrenar/division-FECHA.json   # la fecha que imprime el entrenamiento
npm install && npm run publicar    # solo si evaluar.py mejora al modelo publicado (hoy: 75,0 % / 90,3 % / 11,7 %)
```
`--val-lotes 0` usa toda la validación durante el entrenamiento (en la RTX no hace falta limitarla; en el Mac se limitaba por un fallo del plugin Metal). `npm run publicar` necesita `gh auth login` hecho en ese Ubuntu la primera vez.

## Qué probar con 12 GB de VRAM

- `--arquitectura mobilenetv3` a 224 px (la conversión a TensorFlow.js está pendiente de verificar: si la app no carga el modelo, volver a `mobilenetv2`).
- Más resolución: `--tamano 288` (más detalle en láminas y poros; el modelo en el móvil será algo más lento).
- Más fotos: `--por-especie 800` en la descarga.
