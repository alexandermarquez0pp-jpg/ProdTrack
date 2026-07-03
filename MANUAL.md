# Manual de Sistema - App ProdTrack AIT

Bienvenido a la aplicación **ProdTrack** adaptada para el equipo de AIT y Soporte Técnico. Esta herramienta centraliza el registro de actividades diarias y la supervisión de la agenda del equipo, además de generar automáticamente la reportería necesaria.

## 1. Registro y Accesos
1. **Primer Paso:** El Administrador debe crear una cuenta en el formulario de inicio de sesión marcando el rol "Administrador".
2. **Creación del Grupo:** Una vez dentro, el Admin va a "Gestión" y crea el grupo corporativo (Ej. "Equipo AIT Junín"). Esto generará un *Código de Invitación*.
3. **Registro de Técnicos:** Los pasantes o técnicos inician sesión marcando "Integrante". La app les pedirá el Código de Invitación.
4. El Admin aprueba las solicitudes de los integrantes en la vista de Gestión.

## 2. Para los Pasantes (Técnicos)
La pantalla principal para el personal de campo es **Soporte AIT**.
* Cada vez que se atiende a un usuario, el técnico llena el formulario (Localidad, Nombre, Etiqueta, Actividad, etc.).
* **Fotografías:** Usando el ícono de la cámara al final del formulario, pueden tomar foto a la pantalla o equipo en el que trabajaron. La app comprimirá la foto automáticamente para ahorrar datos.
* Al presionar "Guardar", el registro viaja a la nube.

## 3. Para el Administrador (Supervisión)
Como Administrador, tienes el control absoluto:
* **Agendas del Equipo:** Desde esta vista, puedes ver las tareas de cada persona. 
* **Asignación Múltiple:** Puedes escribir una tarea nueva (ej. "Mantenimiento Preventivo Servidores"), seleccionar a *varios integrantes a la vez* dejando presionado `Ctrl`, asignarles Prioridad 1, 2 o 3, y enviar la tarea. Ellos recibirán una **Notificación Push** en su teléfono/computadora al instante.

## 4. Reportería Automática (El gran ahorro de tiempo)
Desde la vista **Soporte AIT**, tienes dos herramientas de exportación:

### 📄 Reporte Diario (PDF)
* Selecciona al pasante en el menú desplegable.
* Haz clic en **Descargar PDF del Día**.
* Obtendrás un PDF con formato PDVSA y con los emojis institucionales agrupando los tickets de hoy. Si hay fotos, saldrán anexadas.

### 📝 Reporte Semanal (Microsoft Word .doc)
* Selecciona al pasante.
* Haz clic en el nuevo botón azul **Descargar Semanal (Word)**.
* La app buscará todos los registros que hizo esa persona en los **últimos 7 días**.
* Armará el documento y lo descargará en formato `.doc`. 
* Puedes abrir este archivo con Microsoft Word para darle los toques finales, añadir comentarios del supervisor o ajustarlo antes de enviarlo a gerencia los jueves a mediodía.

> [!TIP]
> Recuerden siempre usar `Ctrl + F5` en el navegador tras una actualización para limpiar la memoria caché y obtener las funciones nuevas inmediatamente.
