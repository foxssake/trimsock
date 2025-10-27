extends Control

# An example trimsock server, listening over TCP


const PORT = 9980

var _server: TCPServer
var _reactor: TrimsockTCPServerReactor

@export var logs_label: Label


func _ready() -> void:
	_log("[srv] Init")
	_server = TCPServer.new()
	_reactor = TrimsockTCPServerReactor.new(_server)
	
	_server.listen(PORT)
	_log("[srv] Listening on port %d" % PORT)
	_setup_reactor()
	_log("[srv] Reactor initialized")

func _process(_dt):
	_reactor.poll()

func _setup_reactor() -> void:
	_reactor.on("info", func(_cmd, xchg: TrimsockExchange):
		_log("[cmd] Info: trimsock.gd")
		xchg.reply_or_send(TrimsockCommand.simple("info", "trimsock.gd"))
	).on("whoami", func(_cmd, xchg: TrimsockExchange):
		xchg.reply_or_send(TrimsockCommand.simple("youare", xchg.session()))
	).on("guess", func(_cmd, xchg: TrimsockExchange):
		# Pick an initial number
		var number := randi_range(0, 100)
		xchg.stream(TrimsockCommand.simple("guess", "?"))
		
		while xchg.is_open():
			var response := await xchg.read()
			var guess := int(response.text)
			
			if guess > number:
				xchg.stream(TrimsockCommand.simple("guess", "v"))
			elif guess < number:
				xchg.stream(TrimsockCommand.simple("guess", "^"))
			else:
				xchg.stream(TrimsockCommand.simple("guess", "🎉"))
				xchg.stream_finish(TrimsockCommand.simple(""))
	).on_unknown(func(cmd, xchg: TrimsockExchange):
		_log("[srv] Unknown command: %s" % cmd)
		return TrimsockCommand.error_from(cmd, "error", ["Unknown command", cmd.name])
	)
	
	_reactor.on_attach.connect(func(src: StreamPeerTCP):
		var id := _session_id()
		_log("[srv] New connection: " + id)
		src.set_no_delay(true)
		
		_reactor.set_session(src, id)
		_reactor.send(src, TrimsockCommand.simple("ohai"))
	)
	
	_reactor.on_detach.connect(func(src):
		_log("[srv] Connection closed!")
	)

func _log(what: String) -> void:
	logs_label.text += what + "\n"

func _session_id(length: int = 4) -> String:
	const charset := "abcdefghijklmnopqrstuvwxyz" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "0123456789"
	var id := ""
	for i in length:
		id += charset[randi() % charset.length()]
	return id
