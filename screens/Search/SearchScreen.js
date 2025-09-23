import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../../utils/api';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Clear search when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused - no action needed
      return () => {
        // Screen is unfocused - clear search
        setQuery('');
        setResults([]);
      };
    }, [])
  );

  const searchUsers = async (text) => {
    setQuery(text);
    if (!text || text.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const resp = await API.get(`/users/search?username=${encodeURIComponent(text)}`);
      setResults(resp.data || []);
    } catch (e) {
      console.warn('Search failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    // Prevent navigation to admin profile
    if (item.isAdmin) {
      return null;
    }
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('ShowProfile', { userId: item.id })}
      >
        <Text style={styles.username}>{item.username}</Text>
      </TouchableOpacity>
    );
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search users by username"
          value={query}
          onChangeText={searchUsers}
          style={styles.searchBox}
          autoCapitalize='none'
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator size="small" color="#007AFF" />}

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <View style={styles.empty}><Text style={{color:'gray'}}>No users found</Text></View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#fff' },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    position: 'relative' 
  },
  searchBox: { 
    flex: 1, 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 8, 
    padding: 10, 
    paddingRight: 40 
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#999',
    fontWeight: 'bold',
  },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  username: { fontWeight: '700', fontSize: 16 },
  empty: { padding: 20, alignItems: 'center' }
});
