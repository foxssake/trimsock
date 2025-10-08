extends RefCounted
class_name TrimsockReader

var _line_reader: _TrimsockLineReader = _TrimsockLineReader.new()
var _line_parser: _TrimsockLineParser = _TrimsockLineParser.new()

func ingest_text(text: String) -> Error:
	return _line_reader.ingest(text.to_utf8_buffer())

func ingest_bytes(bytes: PackedByteArray) -> Error:
	return _line_reader.ingest(bytes)

func read() -> TrimsockCommand:
	# TODO: Raw commands
	var line := _line_reader.read_text()
	if not line:
		return null
	
	var command := _line_parser.parse(line)
	if command != null:
		_TrimsockConventions.apply(command)
	return command
