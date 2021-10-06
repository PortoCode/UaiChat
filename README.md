# UaiChat

Chat utilizando arquitetura publish subscribe com o broker MQTT.

# Execução passo a passo

## Passo 1:

Baixar mqtt.cool.
Baixar Java jdk.

Abrir pasta mqtt.cool\bin\windows.
Editar arquivo mc.bat.
Setar caminho em JAVA_HOME para onde está instalado o jdk.

Exemplo: set JAVA_HOME=C:\Program Files\Java\jdk-11.0.11.

## Passo 2:

Dar start no arquivo "start.bat" em mqtt.cool\bin\windows para subir o servidor MQTT.Cool.

## Passo 3:

Executar arquivo index.html do projeto UaiChat.

## Passo 4:

Após a conexão com o servidor MQTT.Cool, informe o seu nome em:
"Qual o seu nome?"

Clique em login para se inscrever no Broker.

## Passo 5:

Após a conexão o nome informado deverá aparecer em "Usuários Logados"
no canto esquerdo.
Após a conexão será possível realizar o envio de mensagens.
Os usuários conectados poderão visualizar as mensagens recebidas pelos demais usuários conectados.

## Passo 6:

Clique em "Desconectar" para fechar a conexão.
Feche o "start.bat".
