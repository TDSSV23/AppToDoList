import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Modal, Image, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import { Magnetometer, Gyroscope } from 'expo-sensors';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants'; 
import { TimePickerAndroid } from 'react-native'; 
import { Audio } from 'expo-av';

export default function App() {
  const [task, setTask] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [isTaskDetailsVisible, setTaskDetailsVisibility] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const [compassHeading, setCompassHeading] = useState(0);
  const [gyroscopeData, setGyroscopeData] = useState({ x: 0, y: 0, z: 0 });
  const [navigation, setNavigation] = useState(useNavigation());
  const [selectedTime, setSelectedTime] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    Magnetometer.addListener(({ x, y }) => {
      const heading = Math.atan2(y, x) * (180 / Math.PI);
      const compassHeading = heading >= 0 ? heading : 360 + heading;
      setCompassHeading(compassHeading);
    });

    Magnetometer.setUpdateInterval(100);

    return () => {
      Magnetometer.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    const subscription = Gyroscope.addListener(({ x, y, z }) => {
      setGyroscopeData({ x, y, z });
    });

    Gyroscope.setUpdateInterval(100);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));
  }, []);

  const handleAddTask = () => {
    if (task && selectedDate && selectedTime) {
      const newTask = { id: Date.now(), task, description, date: selectedDate, time: selectedTime, completed: false, image: selectedImage };
      setTasks([...tasks, newTask].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setTask('');
      setDescription('');
      setSelectedDate('');
      setSelectedTime('');
      setSelectedImage(null);
      sendPushNotification(expoPushToken);
      Alert.alert('Tarefa adicionada com sucesso!');
    } else {
      Alert.alert('Por favor, preencha todos os campos obrigatórios.');
    }
  };

  const handlePickImage = async () => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      alert('Permissão para acessar a galeria é necessária!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.cancelled) {
      setSelectedImage(result.uri);
    }
  };

  const handleTaskDetails = (task) => {
    setSelectedTaskDetails(task);
    setTaskDetailsVisibility(true);
  };

  async function sendPushNotification(expoPushToken) {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: task,
      body: description,
      data: { someData: 'goes here' },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  }

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
      alert('Must use physical device for Push Notifications');
    }

    return token;
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    setDatePickerVisibility(false);
  };

  const handleTimePick = async () => {
    try {
      const { action, hour, minute } = await TimePickerAndroid.open({
        hour: new Date().getHours(),
        minute: new Date().getMinutes(),
        is24Hour: true,
      });
      if (action !== TimePickerAndroid.dismissedAction) {
        const selectedHour = hour < 10 ? `0${hour}` : `${hour}`;
        const selectedMinute = minute < 10 ? `0${minute}` : `${minute}`;
        setSelectedTime(`${selectedHour}:${selectedMinute}`);
      }
    } catch ({ code, message }) {
      console.warn('Erro ao abrir o seletor de hora: ', message);
    }
  };

  const renderTaskItem = ({ item, index }) => (
    <View style={styles.taskContainer}>
      <View style={styles.taskInfo}>
        <Image source={{ uri: item.image }} style={styles.taskImage} />
        <TouchableOpacity onPress={() => handleTaskDetails(item)} style={{ flex: 1 }}>
          <Text style={[styles.task, { textDecorationLine: item.completed ? 'line-through' : 'none' }]}>
            {item.task}
          </Text>
          <Text style={styles.description}>{item.description}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteTask(index)} style={styles.deleteButton}>
          <MaterialIcons name="delete" size={24} color="white" />
        </TouchableOpacity>
      </View>
      <Text style={styles.date}>{item.date}</Text>
      <Text style={styles.time}>{item.time}</Text>
      <TouchableOpacity onPress={() => handleToggleComplete(index)} style={styles.checkBox}>
        <MaterialIcons name={item.completed ? 'check-box' : 'check-box-outline-blank'} size={24} color="white" />
      </TouchableOpacity>
    </View>
  );

  const handleDeleteTask = (index) => {
    const updatedTasks = [...tasks];
    updatedTasks.splice(index, 1);
    setTasks(updatedTasks);
  };

  const handleToggleComplete = (index) => {
    const updatedTasks = [...tasks];
    const task = updatedTasks.splice(index, 1)[0];
    task.completed = !task.completed;
    updatedTasks.push(task);
    setTasks(updatedTasks);
  };

  return (
    <LinearGradient
      colors={['#4CB5FB', '#4CB5FB', '#4CB5FB']}
      style={styles.container}>
      <Text style={styles.title}>TAREFAS</Text>
      <TouchableOpacity onPress={() => setDatePickerVisibility(true)} style={styles.datePickerButton}>
        <Text style={styles.buttonText}>Selecionar Data</Text>
      </TouchableOpacity>
      <Text style={styles.selectedDateText}>{selectedDate}</Text>
      <TouchableOpacity onPress={handleTimePick} style={styles.datePickerButton}>
        <Text style={styles.buttonText}>Selecionar Hora</Text>
      </TouchableOpacity>
      <Text style={styles.selectedDateText}>{selectedTime}</Text>
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Tarefa"
          value={task}
          onChangeText={text => setTask(text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Descrição"
          value={description}
          onChangeText={text => setDescription(text)}
        />
        <TouchableOpacity style={styles.button} onPress={handleAddTask}>
          <Text style={styles.buttonText}>Adicionar Tarefa</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickImage}>
          <Text style={styles.inputImage}>Selecionar Imagem</Text>
        </TouchableOpacity>
        {selectedImage && (
          <Image source={{ uri: selectedImage }} style={styles.image} />
        )}
      </View>
      <FlatList
        data={tasks}
        renderItem={renderTaskItem}
        keyExtractor={item => item.id.toString()}
      />

      {/* Modais e outras partes do código... */}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    color: 'white',
    marginBottom: 20,
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: 'blue',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  taskContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    width: '99%',
  },
  task: {
    flex: 1,
    fontSize: 16,
    color: 'white',
  },
  description: {
    fontSize: 14,
    color: 'white',
  },
  date: {
    fontSize: 14,
    color: 'white',
  },
  time: {
    fontSize: 14,
    color: 'white',
  },
  datePickerButton: {
    backgroundColor: 'blue',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  selectedDateText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteButton: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
  },
  taskImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  gyroscopeContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  heading: {
    fontSize: 24,
    marginBottom: 10,
    color: 'white',
  },
  checkBox: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  clock: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
  },
});
