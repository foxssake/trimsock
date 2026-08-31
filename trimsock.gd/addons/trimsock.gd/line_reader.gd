extends RefCounted
class_name _TrimsockLineReader

var buffer := PackedByteArray()
var max_size := 16384
var at := 0
var is_quote := false
var is_escape := false

func reset() -> void:
	buffer.clear()
	at = 0
	is_quote = false
	is_escape = false

func ingest(data: PackedByteArray) -> Error:
	var new_size := buffer.size() + data.size()
	if new_size > max_size:
		reset()
		return ERR_OUT_OF_MEMORY

	buffer.append_array(data)
	return OK

func read_text() -> String:
	while not is_eob():
		if is_escape:
			is_escape = false
		elif chr() == "\"":
			is_quote = not is_quote
		elif chr() == "\\":
			is_escape = true
		elif chr() == "\n" and not is_quote:
			return _flush_line()
		at += 1
	return ""

func has_data(size: int) -> bool:
	return buffer.size() > size

func read_data(size: int) -> Array:
	assert(has_data(size), "Trying to read more bytes than available!")

	# Grab result
	var result := buffer.slice(0, size)
	var is_terminated := String.chr(buffer[size]) == "\n"

	buffer = buffer.slice(size + 1)
	at = 0

	# Reset flags
	is_escape = false
	is_quote = false

	if not is_terminated:
		return [ERR_PARSE_ERROR, PackedByteArray()]

	return [OK, result]

func chr() -> String:
	return String.chr(buffer[at])

func is_eob() -> bool:
	return at >= buffer.size()

# Return string up to the current character ( exclusive ), and discard
# everything before ( inclusive ) the current character
func _flush_line() -> String:
	var line := buffer.slice(0, at).get_string_from_utf8()
	buffer = buffer.slice(at + 1)
	at = 0
	
	return line
