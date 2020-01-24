# A Chat module
It will use the RabbitMQ package along with MQTT to provide instant messaging,
using low bandwidth along with the natural speed of RabbitMQ.

NOTE: We need to make sure,that we can split the RabbitMQ deployments,
so that on high-traffic scenarios, the queue that handles server work, can scale
independently from the chat queue. 
