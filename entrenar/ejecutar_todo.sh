#!/bin/zsh
# Prepara el entorno, descarga las fotos y entrena el modelo, todo seguido.
# Uso: zsh entrenar/ejecutar_todo.sh > entrenar/registro.log 2>&1 &
# El entorno de Python se crea en ~/.micelio/venv (disco interno: los discos externos
# con formato exFAT no admiten los enlaces que necesita un venv).
set -e
cd "$(dirname "$0")"
VENV="$HOME/.micelio/venv"
echo "== $(date) :: preparando entorno en $VENV"
if [ ! -x "$VENV/bin/python" ]; then python3 -m venv "$VENV"; fi
source "$VENV/bin/activate"
python -m pip install --upgrade pip >/dev/null
python -m pip install -r requirements.txt
python -m pip install tensorflow-metal || echo "(sin tensorflow-metal: se entrenará con CPU)"
python -c "import tensorflow as tf, tensorflowjs; print('TensorFlow', tf.__version__, '· dispositivos:', [d.device_type for d in tf.config.list_physical_devices()])"
echo "== $(date) :: descargando fotos"
python descargar_imagenes.py --por-especie ${FOTOS_POR_ESPECIE:-200}
echo "== $(date) :: entrenando"
python entrenar.py --epocas ${EPOCAS:-15}
echo "== $(date) :: TERMINADO"
