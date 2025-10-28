from models.persona import Persona
from services.firebase_client import buscar_usuario, add_user, update_user, delete_user, get_all_users

class Administrador:
    def __init__(self):
        self.preguntas = [
            "¿Cuál es nombre de usuario",
            "¿Cuál es tu correo electrónico?",
            "¿Cuál es tu contraseña?",
            "¿repite tu contraseña?"
        ]
        self.respuestas = []

    def realizar_registro_persona(self):
        print("Bienvenido al registro. Por favor, responde las siguientes preguntas:")
        for pregunta in self.preguntas:
            respuesta = input(f"{pregunta} ")
            self.respuestas.append(respuesta)
        persona = Persona(
            usuario=self.respuestas[0],
            correo=self.respuestas[1],
            contraseña=self.respuestas[2],
        )
        persona_dict = persona.__dict__
        return persona_dict

    
    def Registro(self):
        print(f"\nRegistro")
        registrar = Administrador()
        persona = registrar.realizar_registro_persona()
        add_user(persona)  


    def _personas_registradas(self):
        print("\nPersonas registradas (desde Firebase):")
        usuarios = get_all_users()
        if not usuarios:
            print("No hay usuarios en la base de datos.")
        else:
            for id,  datos in usuarios.items():
                print(f"  Nombre: {datos.get('usuario')}")
                print(f"  Correo: {datos.get('correo')}")
                print(f"  Cédula: {datos.get('contraseña')}")
                print("---------------------------")
    
    @property
    def personas_registradas(self):
        self._personas_registradas()

    def editar_usuario(self):
        usuario_buscar = input("Ingresa el usuario que deseas editar: ")
        usuarios = get_all_users()
        if not usuarios:
            print("No hay usuarios en la base de datos.")
            return

        datos = buscar_usuario(usuario_buscar)
        if not datos:
            print(f"No se encontró un usuario: {usuario_buscar}.")
            return

        usuario_actual = datos.get("usuario","")
        correo_actual = datos.get("correo","") 
        contraseña_actual = datos.get("contraseña","") 

        print(f"Editando usuario: {usuario_actual} ({usuario_buscar})")

        nuevo_usuario = input(f"Nuevo nombre ({usuario_actual}): ")
        nuevo_correo = input(f"Nuevo correo ({correo_actual}): ")
        nueva_contraseña= input(f"Nueva contraseña ({contraseña_actual}): ")

        actualizado = dict(datos) 
        if nuevo_usuario:
            actualizado["usuario"] = nuevo_usuario
        if nuevo_correo:
            actualizado["correo"] = nuevo_correo
        if nueva_contraseña:
            actualizado["contraseña"] = nueva_contraseña

        if nuevo_usuario and nuevo_usuario != usuario_buscar:
            add_user(actualizado)       
            delete_user(usuario_buscar) 
        else:
            update_user(usuario_buscar, actualizado)
        
    def eliminar_usuario(self):

        usuario_buscar = input("Ingresa el usuario que deseas eliminar: ")
        usuarios = get_all_users()
        if not usuarios:
            print("No hay usuarios en la base de datos.")
            return

        delete_user(usuario_buscar)

        print(f"Usuario {usuario_buscar} eliminado exitosamente.")
