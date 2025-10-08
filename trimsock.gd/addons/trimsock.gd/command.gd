extends RefCounted
class_name TrimsockCommand

class Chunk:
	var text: String
	var is_quoted: bool

class Pair:
	var key: String
	var value: String

enum Type {
	SIMPLE,
	REQUEST,
	SUCCESS_RESPONSE,
	ERROR_RESPONSE,
	STREAM_CHUNK,
	STREAM_FINISH
}

# Core properties
var name: String = ""
var text: String = ""
var chunks: Array[Chunk] = []
var is_raw: bool = false
var raw: PackedByteArray

# Multiparam
var params: Array[String]

# Key-value pairs
var kv_pairs: Array[Pair]
var kv_map: Dictionary

# Request-response + Stream
var exchange_id: String
var type: Type = Type.SIMPLE


static func unescape(what: String) -> String:
	return (what
		.replace("\\n", "\n")
		.replace("\\r", "\r")
		.replace("\\\"", "\"")
	)

static func pair_of(key: String, value: String) -> Pair:
	var pair := Pair.new()
	pair.key = key
	pair.value = value
	return pair

static func type_string(type: Type) -> String:
	match type:
		Type.SIMPLE: return "Simple"
		Type.REQUEST: return "Request"
		Type.SUCCESS_RESPONSE: return "Success Response"
		Type.ERROR_RESPONSE: return "Error Response"
		Type.STREAM_CHUNK: return "Stream Chunk"
		Type.STREAM_FINISH: return "Stream Finish"
	return "%d???" % [type]


func is_request() -> bool:
	return type == Type.REQUEST

func is_success() -> bool:
	return type == Type.SUCCESS_RESPONSE

func is_error() -> bool:
	return type == Type.ERROR_RESPONSE

func is_stream_chunk() -> bool:
	return type == Type.STREAM_CHUNK

func is_stream_end() -> bool:
	return type == Type.STREAM_FINISH
