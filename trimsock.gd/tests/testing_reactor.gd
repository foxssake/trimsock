extends TrimsockReactor
class_name TestingReactor

class SentCommand:
	var command: TrimsockCommand
	var target: Variant
	
	static func of(command: TrimsockCommand, target: Variant) -> SentCommand:
		var result := SentCommand.new()
		result.command = command
		result.target = target
		return result

var outbox: Array[SentCommand] = []

func has_sent_command(target: Variant, command: TrimsockCommand) -> bool:
	return outbox.any(func(it): return it.command == command and it.target == target)

func ingest_data(source: Variant, data: PackedByteArray) -> Error:
	return _ingest(source, data)

func ingest_text(source: Variant, text: String) -> Error:
	return _ingest(source, text.to_utf8_buffer())

func _write(target: Variant, command: TrimsockCommand) -> void:
	outbox.append(SentCommand.of(command, target))
