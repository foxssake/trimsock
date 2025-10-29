extends TrimsockIDGenerator
class_name IncrementalTrimsockIDGenerator

## Generates IDs by incrementing an internal counter
##
## The internal counter is converted to a hexadecimal string.


var _at := -1


## Get the next ID
func get_id() -> String:
	_at += 1
	return "%x" % _at
