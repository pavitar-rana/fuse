package main

import (
	"errors"
	"fmt"
	"os"
)

func getInput() (string, error) {
	if len(os.Args) < 2 {
		return "", errors.New("NO INPUT FOUND")
	}
	input := os.Args[1]
	return fmt.Sprintf("Hi %s!", input), nil
}

func main() {
	res, err := getInput()
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	fmt.Println(res)
}
