extends Object
class_name _TrimsockConventions


static func apply(command: TrimsockCommand) -> void:
	parse_type(command)

static func parse_type(command: TrimsockCommand) -> void:
	var at := 0

	# Figure out command type
	while true:
		at = command.name.find("?")
		if at >= 0:
			command.type = TrimsockCommand.Type.REQUEST
			break
		
		at = command.name.find(".")
		if at >= 0:
			command.type = TrimsockCommand.Type.SUCCESS_RESPONSE
			break
		
		at = command.name.find("!")
		if at >= 0:
			command.type = TrimsockCommand.Type.ERROR_RESPONSE
			break
		
		at = command.name.find("|")
		if at >= 0:
			if ((command.is_raw and command.raw.is_empty()) or command.text.is_empty()):
				command.type = TrimsockCommand.Type.STREAM_FINSIH
			else:
				command.type = TrimsockCommand.Type.STREAM_CHUNK
			break
		return

	var name := command.name.substr(0, at)
	var id := command.name.substr(at + 1)

	command.name = name
	command.exchange_id = id

func _init():
	assert(false, "This class shouldn't be instantiated!")
