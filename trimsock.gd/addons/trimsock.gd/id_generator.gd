extends RefCounted
class_name TrimsockIDGenerator

## Base class for generating IDs
##
## Used by [TrimsockReactor] to generate exchange IDs. To implement a custom
## ID generator, extend this class and implement [method get_id].

## Get the next ID
func get_id() -> String:
	return ""
