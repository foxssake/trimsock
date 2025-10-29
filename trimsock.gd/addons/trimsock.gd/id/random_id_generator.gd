extends TrimsockIDGenerator
class_name RandomTrimsockIDGenerator

## Generates IDs by stringing together random characters from a predefined set
## of characters
##
## Uses an internal [RandomNumberGenerator] to pick characters.


## Character set used for the individual characters in the ID
var charset := "abcdeghijklmnopqrstuvwxyz" + "ABCDEFGHIJLKMNOPQRSTUVWXYZ" + "0123456789"
## Length of the ID, in characters
var length := 8

var _rng := RandomNumberGenerator.new()


func _init(p_length: int = 8, p_charset: String = ""):
	length = p_length
	if p_charset:
		charset = p_charset

## Get the next ID
func get_id() -> String:
	var id := ""
	for i in length:
		id += charset[_rng.randi() % charset.length()]
	return id
